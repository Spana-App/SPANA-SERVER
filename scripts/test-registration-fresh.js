const axios = require('axios');
require('dotenv').config();

async function registerProvider() {
  try {
    console.log('\n🔐 Step 1: Logging in as admin...\n');
    
    const baseUrl = process.env.TEST_API_URL || 'http://localhost:5003';
    // NEVER use eksnxiweni@gmail.com or any variant - use a completely different test email
    const timestamp = Date.now();
    const testEmail = `spana-test-${timestamp}@example.com`; // Use example.com for testing
    
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

    console.log('👤 Step 2: Registering service provider...\n');
    console.log(`   Email: ${testEmail}\n`);
    
    // Register service provider
    const registerResponse = await axios.post(
      `${baseUrl}/admin/providers/register`,
      {
        firstName: 'Eks',
        lastName: 'Nxiweni',
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
      console.log('   • Subject: Welcome to SPANA, Eks Nxiweni! 🎉');
      console.log('   • From: noreply.spana@gmail.com');
      console.log('   • Contains: Profile completion link');
      console.log('   • Sent via: Gmail SMTP\n');
      console.log('🔗 Profile Completion Link:');
      console.log('   ', registerResponse.data.profileCompletionLink, '\n');
      console.log('✅ Full registration flow completed successfully!\n');
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

registerProvider();
