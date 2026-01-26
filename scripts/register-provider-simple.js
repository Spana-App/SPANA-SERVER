const axios = require('axios');
require('dotenv').config();

async function registerProvider() {
  try {
    console.log('\n🔐 Step 1: Logging in as admin...\n');
    
    // Use localhost for testing (override EXTERNAL_API_URL if set)
    const baseUrl = process.env.TEST_API_URL || 'http://localhost:5003';
    
    // Login as admin
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

    // IMPORTANT: Do NOT use eksnxiweni@gmail.com for testing
    // Use a different email or ask user for test email
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    console.log(`👤 Step 2: Registering ${testEmail} as service provider...\n`);
    
    // First, try to delete existing user if exists
    try {
      console.log('🔍 Checking if user already exists...\n');
      const checkUser = await axios.get(`${baseUrl}/users?email=eksnxiweni@gmail.com`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (checkUser.data && checkUser.data.length > 0) {
        console.log('⚠️  User already exists. Registration will fail if email is duplicate.\n');
      }
    } catch (err) {
      // Ignore - user might not exist
    }
    
    // Register service provider
    const registerResponse = await axios.post(
      `${baseUrl}/admin/providers/register`,
      {
        firstName: 'Test',
        lastName: 'User',
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
      console.log('✅ Service provider registered successfully!\n');
      console.log('📋 Details:');
      console.log('   User ID:', registerResponse.data.user.id);
      console.log('   Email:', registerResponse.data.user.email);
      console.log('   Name:', registerResponse.data.user.firstName, registerResponse.data.user.lastName);
      console.log('   Role:', registerResponse.data.user.role);
      console.log('\n📧 Welcome email sent!');
      console.log(`   Check ${testEmail} for:`);
      console.log(`   • Subject: Welcome to SPANA, Test User! 🎉`);
      console.log('   • From: noreply.spana@gmail.com');
      console.log('   • Contains: Profile completion link');
      console.log('   • Sent via: Gmail SMTP\n');
      console.log('🔗 Profile Completion Link:');
      console.log('   ', registerResponse.data.profileCompletionLink, '\n');
    } else {
      console.error('❌ Registration failed');
      console.log(registerResponse.data);
    }
  } catch (error) {
    if (error.response) {
      console.error('\n❌ Error (Status:', error.response.status, ')\n');
      if (error.response.data) {
        if (typeof error.response.data === 'string') {
          console.error('Response:', error.response.data.substring(0, 200));
        } else {
          console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
      }
      
      if (error.response.status === 404) {
        console.log('\n💡 Route not found. Make sure backend server is restarted to load new routes.\n');
      } else if (error.response.status === 400 && error.response.data.message?.includes('already exists')) {
        console.log('\n💡 User already exists. Delete the user first or use a different email.\n');
      }
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

registerProvider();
