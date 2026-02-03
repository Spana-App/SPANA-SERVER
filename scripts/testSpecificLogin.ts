/**
 * Test Specific User Login
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5003';

async function testLogin() {
  console.log('🔐 Testing Login\n');
  console.log('Email: xolinxiweni@outlook.com');
  console.log('Password: c7C8#1QfJbSv\n');

  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'xolinxiweni@outlook.com',
      password: 'c7C8#1QfJbSv'
    });

    if (response.status === 200) {
      console.log('✅ LOGIN SUCCESSFUL!\n');
      console.log('Response:');
      console.log('─'.repeat(60));
      console.log(JSON.stringify(response.data, null, 2));
      console.log('─'.repeat(60));
      console.log('\n📝 User Details:');
      console.log(`   ID: ${response.data.user?.id || response.data.id}`);
      console.log(`   Name: ${response.data.user?.firstName || response.data.firstName} ${response.data.user?.lastName || response.data.lastName}`);
      console.log(`   Email: ${response.data.user?.email || response.data.email}`);
      console.log(`   Role: ${response.data.user?.role || response.data.role}`);
      console.log(`\n🎫 Token: ${response.data.token?.substring(0, 50)}...`);
    }
  } catch (error: any) {
    if (error.response) {
      console.log('❌ LOGIN FAILED\n');
      console.log(`Status: ${error.response.status} ${error.response.statusText}`);
      console.log(`Message: ${error.response.data?.message || error.response.data?.error || 'Unknown error'}`);
      console.log('\nFull Response:');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`❌ Network Error: ${error.message}`);
    }
  }
}

testLogin();
