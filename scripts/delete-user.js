const axios = require('axios');
require('dotenv').config();

async function deleteUser() {
  try {
    const baseUrl = process.env.TEST_API_URL || 'http://localhost:5003';
    const email = process.argv[2] || 'eksnxiweni@gmail.com';
    
    console.log(`\n🔐 Logging in as admin to delete user: ${email}...\n`);
    
    // Login as admin
    const loginResponse = await axios.post(`${baseUrl}/auth/login`, {
      email: 'xoli@spana.co.za',
      password: 'TestPassword@123!'
    });

    let adminToken;
    
    if (loginResponse.data.requiresOTP) {
      console.log('📧 OTP required. OTP:', loginResponse.data.otp);
      const otpResponse = await axios.post(`${baseUrl}/admin/otp/verify`, {
        email: 'xoli@spana.co.za',
        otp: loginResponse.data.otp
      });
      adminToken = otpResponse.data.token;
    } else {
      adminToken = loginResponse.data.token;
    }

    // Find user by email
    const usersResponse = await axios.get(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const user = usersResponse.data.find((u: any) => u.email === email);
    
    if (!user) {
      console.log(`✅ User ${email} not found (may already be deleted)\n`);
      return;
    }

    console.log(`Found user: ${user.id} - ${user.email}`);
    console.log(`Deleting user...\n`);

    // Delete user (if there's a delete endpoint)
    // For now, we'll just log that we found them
    // You may need to delete via database or admin endpoint
    console.log(`⚠️  User exists but no delete endpoint available.`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   You may need to delete manually from database.\n`);
    
  } catch (error) {
    if (error.response) {
      console.error('Error:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

deleteUser();
