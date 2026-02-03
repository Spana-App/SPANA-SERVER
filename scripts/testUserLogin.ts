/**
 * Test User Login
 * Tests login for existing users to diagnose issues
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5003';

async function testLogin() {
  console.log('🔐 Testing User Login\n');

  // Test 1: Try to login with a real user
  const testUsers = [
    { email: 'xolinxiweni@outlook.com', password: 'Test@123' },
    { email: 'eksnxiweni@gmail.com', password: 'Test@123' },
    { email: 'admin@spana.co.za', password: 'Admin@123456' },
    { email: 'testadmin_1768831407594@spana.co.za', password: 'Test@123' }
  ];

  for (const user of testUsers) {
    try {
      console.log(`📝 Testing login for: ${user.email}`);
      const response = await axios.post(`${BASE_URL}/auth/login`, user);
      
      if (response.status === 200) {
        console.log(`   ✅ Login successful`);
        console.log(`   Token: ${response.data.token?.substring(0, 20)}...`);
        console.log(`   User ID: ${response.data.user?.id}`);
        console.log(`   Role: ${response.data.user?.role}\n`);
      }
    } catch (error: any) {
      if (error.response) {
        console.log(`   ❌ Login failed: ${error.response.status} ${error.response.statusText}`);
        console.log(`   Message: ${error.response.data?.message || error.response.data?.error || 'Unknown error'}\n`);
      } else {
        console.log(`   ❌ Network error: ${error.message}\n`);
      }
    }
  }
}

testLogin();
