const axios = require('axios');

async function testAdminProviderRegistration() {
  try {
    console.log('\n📝 Testing Admin Service Provider Registration...\n');

    // First, login as admin to get token
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post('http://localhost:5003/auth/login', {
      email: 'xoli@spana.co.za',
      password: 'TestPassword@123!'
    });

    if (loginResponse.status !== 200 || !loginResponse.data.token) {
      console.error('❌ Admin login failed');
      console.log('Response:', loginResponse.data);
      return;
    }

    const adminToken = loginResponse.data.token;
    console.log('✅ Admin logged in successfully\n');

    // Delete existing user if exists
    const testEmail = 'testprovider@example.com';
    try {
      const deleteResponse = await axios.delete(`http://localhost:5003/users/${testEmail}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('🗑️  Deleted existing test user\n');
    } catch (e) {
      // User doesn't exist, that's fine
    }

    // Register service provider via admin endpoint
    console.log('2. Registering service provider via admin endpoint...');
    const registerResponse = await axios.post(
      'http://localhost:5003/admin/providers/register',
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
      console.log('✅ Service provider registered successfully!\n');
      console.log('User ID:', registerResponse.data.user.id);
      console.log('Email:', registerResponse.data.user.email);
      console.log('Profile Completion Link:', registerResponse.data.profileCompletionLink);
      console.log('\n📧 Welcome email should be sent via Resend!');
      console.log('Check', testEmail, 'for the email with profile completion link.\n');
    } else {
      console.error('❌ Registration failed');
      console.log('Response:', registerResponse.data);
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ Error (Status:', error.response.status, ')\n');
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testAdminProviderRegistration();
