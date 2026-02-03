const axios = require('axios');
require('dotenv').config();

async function registerOscarProvider() {
  try {
    console.log('\n📝 Registering Oscar as Service Provider\n');
    console.log('='.repeat(60));

    // Use localhost for local development (server is running locally)
    // Change to process.env.EXTERNAL_API_URL if you want to use production
    const baseUrl = 'http://localhost:5003';
    const oscarEmail = 'okpoko15@gmail.com';
    
    console.log(`🌐 Using API URL: ${baseUrl}`);

    // Step 1: Login as admin to get token
    console.log('\n1️⃣ Logging in as admin...');
    const loginResponse = await axios.post(`${baseUrl}/auth/login`, {
      email: 'xoli@spana.co.za',
      password: 'TestPassword@123!'
    }, {
      timeout: 10000 // 10 second timeout
    });

    let adminToken;

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

      adminToken = otpResponse.data.token;
      console.log('✅ Admin authenticated successfully\n');
    } else if (loginResponse.data.token) {
      adminToken = loginResponse.data.token;
      console.log('✅ Admin logged in successfully\n');
    } else {
      console.error('❌ Admin login failed');
      console.log('Response:', loginResponse.data);
      return;
    }

    // Step 2: Check if Oscar already exists
    console.log('3️⃣ Checking if Oscar already exists...');
    try {
      const findUserResponse = await axios.get(
        `${baseUrl}/users?email=${encodeURIComponent(oscarEmail)}`,
        {
          headers: { Authorization: `Bearer ${adminToken}` }
        }
      );
      
      if (findUserResponse.data && findUserResponse.data.length > 0) {
        const userId = findUserResponse.data[0].id;
        console.log(`   ⚠️  Found existing user: ${userId}`);
        console.log('   User already exists with this email.');
        console.log('   If you want to re-register, please delete the user first.\n');
        return;
      } else {
        console.log('   ✅ No existing user found\n');
      }
    } catch (e) {
      if (e.response && e.response.status === 404) {
        console.log('   ✅ No existing user found\n');
      } else {
        console.log('   ⚠️  Could not check existing user (continuing anyway)\n');
      }
    }

    // Step 3: Register Oscar as service provider via admin endpoint
    console.log('4️⃣ Registering Oscar as service provider...');
    console.log(`   Email: ${oscarEmail}`);
    console.log(`   Name: Oscar Poco`);
    console.log(`   Phone: +27123456789 (placeholder - update if needed)`);
    
    const registerResponse = await axios.post(
      `${baseUrl}/admin/providers/register`,
      {
        firstName: 'Oscar',
        lastName: 'Poco',
        email: oscarEmail,
        phone: '+27123456789' // Placeholder - update with actual phone number if available
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (registerResponse.status === 201) {
      console.log('\n✅ Oscar registered successfully as service provider!\n');
      console.log('📋 Registration Details:');
      console.log('   User ID:', registerResponse.data.user.id);
      console.log('   Email:', registerResponse.data.user.email);
      console.log('   Name:', registerResponse.data.user.firstName, registerResponse.data.user.lastName);
      console.log('   Role:', registerResponse.data.user.role);
      console.log('   Reference Number:', registerResponse.data.user.referenceNumber);
      console.log('\n📧 Email Information:');
      console.log('   Profile Completion Link:', registerResponse.data.profileCompletionLink);
      console.log('\n📬 Oscar will receive an email:');
      console.log(`   Email: ${oscarEmail}`);
      console.log('   Subject: Welcome to SPANA, Oscar Poco! 🎉');
      console.log('   Should contain "Complete Profile" button\n');
      
      console.log('✅ Registration complete!');
      console.log('   Oscar can now complete his profile and set his password via the link sent in email.\n');
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

registerOscarProvider();
