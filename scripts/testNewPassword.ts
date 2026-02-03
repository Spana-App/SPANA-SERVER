/**
 * Test Login with New Password
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5003';

async function testLogin() {
  console.log('🔐 Testing Login with NEW Password\n');
  console.log('Email: xolinxiweni@outlook.com');
  console.log('Password: Spana@2026\n');

  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'xolinxiweni@outlook.com',
      password: 'Spana@2026'
    });

    if (response.status === 200) {
      console.log('✅ LOGIN SUCCESSFUL!\n');
      console.log('📝 User Details:');
      console.log(`   ID: ${response.data.user?.id || response.data.id}`);
      console.log(`   Name: ${response.data.user?.firstName || response.data.firstName} ${response.data.user?.lastName || response.data.lastName}`);
      console.log(`   Email: ${response.data.user?.email || response.data.email}`);
      console.log(`   Role: ${response.data.user?.role || response.data.role}`);
      console.log(`\n🎫 Token (first 50 chars):`);
      console.log(`   ${response.data.token?.substring(0, 50)}...`);
      console.log(`\n✅ You can now login to the website with:`);
      console.log(`   Email: xolinxiweni@outlook.com`);
      console.log(`   Password: Spana@2026`);
    }
  } catch (error: any) {
    if (error.response) {
      console.log('❌ LOGIN FAILED\n');
      console.log(`Status: ${error.response.status} ${error.response.statusText}`);
      console.log(`Message: ${error.response.data?.message || error.response.data?.error}`);
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

testLogin();
