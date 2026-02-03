import axios from 'axios';

const BACKEND_URL = 'https://spana-server-5bhu.onrender.com';
const email = 'xoli@spana.co.za';
const password = 'TestPassword123!';

async function testAdminLogin() {
  try {
    console.log('🔐 Testing Admin Login on Hosted Server\n');
    console.log(`URL: ${BACKEND_URL}/auth/login`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}\n`);

    const response = await axios.post(
      `${BACKEND_URL}/auth/login`,
      {
        email,
        password
      },
      {
        timeout: 15000,
        validateStatus: () => true // Accept all status codes
      }
    );

    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      if (response.data.requiresOTP) {
        console.log('\n✅ Login successful! Password is correct.');
        console.log('📧 OTP has been sent to your email.');
        console.log(`\n🔑 OTP: ${response.data.otp}`);
        console.log(`\n📋 Next steps:`);
        console.log('   1. Check your email for the OTP');
        console.log('   2. POST /admin/otp/verify with email and OTP');
        console.log('   3. You will receive a JWT token');
        
        if (response.data.verificationLink) {
          console.log(`\n🔗 Verification Link: ${response.data.verificationLink}`);
        }
      } else {
        console.log('\n✅ Login successful! You received a token directly.');
        console.log(`Token: ${response.data.token?.substring(0, 50)}...`);
      }
    } else if (response.status === 400) {
      if (response.data.message === 'Invalid credentials') {
        console.log('\n❌ Invalid credentials');
        console.log('💡 This means either:');
        console.log('   - User does not exist in production database');
        console.log('   - Password is incorrect');
        console.log('\n📋 Solutions:');
        console.log('   1. Create admin user via /admin/admins/register (if you have another admin)');
        console.log('   2. Wait for database pool to clear and run createAdminUser script locally');
        console.log('   3. Manually create user in database');
      } else {
        console.log('\n❌ Error:', response.data.message);
      }
    } else {
      console.log('\n❌ Unexpected response:', response.status);
    }

  } catch (error: any) {
    console.error('❌ Error testing login:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAdminLogin();
