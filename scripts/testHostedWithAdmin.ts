/**
 * Test Hosted Backend with Admin Authentication
 * Logs in as admin and tests all admin endpoints
 */

import axios from 'axios';

const BASE_URL = 'https://spana-server-5bhu.onrender.com';
const ADMIN_EMAIL = 'xoli@spana.co.za';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function loginAsAdmin(): Promise<string | null> {
  try {
    log('🔐 Logging in as admin...', colors.cyan);
    log(`   Email: ${ADMIN_EMAIL}`, colors.yellow);
    
    const loginResponse = await axios.post(
      `${BASE_URL}/auth/login`,
      {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      },
      {
        timeout: 30000,
        validateStatus: () => true
      }
    );

    if (loginResponse.status === 200) {
      if (loginResponse.data.requiresOTP) {
        log('   ⚠️  Admin login requires OTP', colors.yellow);
        const otp = loginResponse.data.otp;
        log(`   OTP: ${otp}`, colors.cyan);
        
        // Verify OTP
        log('   Verifying OTP...', colors.yellow);
        const verifyResponse = await axios.post(
          `${BASE_URL}/admin/otp/verify`,
          {
            email: ADMIN_EMAIL,
            otp: otp
          },
          {
            timeout: 30000,
            validateStatus: () => true
          }
        );

        if (verifyResponse.status === 200 && verifyResponse.data.token) {
          log('   ✅ OTP verified! Admin token received', colors.green);
          return verifyResponse.data.token;
        } else {
          log(`   ❌ OTP verification failed: ${JSON.stringify(verifyResponse.data)}`, colors.red);
          return null;
        }
      } else if (loginResponse.data.token) {
        log('   ✅ Admin logged in successfully', colors.green);
        return loginResponse.data.token;
      } else {
        log(`   ❌ Login failed: ${JSON.stringify(loginResponse.data)}`, colors.red);
        return null;
      }
    } else {
      log(`   ❌ Login failed with status ${loginResponse.status}`, colors.red);
      log(`   Response: ${JSON.stringify(loginResponse.data)}`, colors.yellow);
      return null;
    }
  } catch (error: any) {
    log(`   ❌ Login error: ${error.message}`, colors.red);
    if (error.response) {
      log(`   Response: ${JSON.stringify(error.response.data)}`, colors.yellow);
    }
    return null;
  }
}

async function testEndpoint(name: string, url: string, token: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<{ success: boolean; statusCode?: number; data?: any; error?: string }> {
  try {
    const config: any = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      validateStatus: () => true
    };

    if (data && method === 'POST') {
      config.data = data;
    }

    const response = await axios(config);
    
    return {
      success: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      data: response.data
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      statusCode: error.response?.status
    };
  }
}

async function runTests() {
  log('\n🧪 TESTING HOSTED BACKEND WITH ADMIN AUTHENTICATION\n', colors.bright);
  log('='.repeat(80), colors.cyan);

  // Step 1: Login as admin
  const adminToken = await loginAsAdmin();
  
  if (!adminToken) {
    log('\n❌ Failed to obtain admin token. Cannot proceed with admin endpoint tests.', colors.red);
    return;
  }

  log(`\n✅ Admin Token: ${adminToken.substring(0, 30)}...`, colors.green);
  log('\n' + '='.repeat(80), colors.cyan);
  log('📋 Testing Admin Endpoints\n', colors.bright);

  // Test admin endpoints
  const endpoints = [
    { name: 'Get All Users', path: '/admin/users', method: 'GET' as const },
    { name: 'Get All Bookings', path: '/admin/bookings', method: 'GET' as const },
    { name: 'Get All Services', path: '/admin/services', method: 'GET' as const },
    { name: 'Get All Applications', path: '/admin/applications', method: 'GET' as const },
    { name: 'Get Wallet Summary', path: '/admin/wallet/summary', method: 'GET' as const },
    { name: 'Get Wallet Transactions', path: '/admin/wallet/transactions', method: 'GET' as const },
    { name: 'Get Pending Documents', path: '/admin/documents/pending', method: 'GET' as const },
    { name: 'Get All Complaints', path: '/admin/complaints', method: 'GET' as const },
  ];

  let passed = 0;
  let failed = 0;

  for (const endpoint of endpoints) {
    const result = await testEndpoint(
      endpoint.name,
      `${BASE_URL}${endpoint.path}`,
      adminToken,
      endpoint.method
    );

    if (result.success) {
      log(`✅ ${endpoint.name}`, colors.green);
      log(`   Status: ${result.statusCode}`, colors.cyan);
      passed++;
    } else {
      log(`❌ ${endpoint.name}`, colors.red);
      log(`   Status: ${result.statusCode || 'N/A'}`, colors.yellow);
      if (result.error) {
        log(`   Error: ${result.error}`, colors.yellow);
      }
      if (result.data) {
        log(`   Response: ${JSON.stringify(result.data).substring(0, 200)}`, colors.yellow);
      }
      failed++;
    }
  }

  // Test public endpoints
  log('\n' + '='.repeat(80), colors.cyan);
  log('📋 Testing Public Endpoints\n', colors.bright);

  const publicEndpoints = [
    { name: 'Health Check', path: '/health', method: 'GET' as const },
    { name: 'Get Services', path: '/services', method: 'GET' as const },
    { name: 'Platform Stats', path: '/stats/platform', method: 'GET' as const },
    { name: 'Provider Stats by Location', path: '/stats/providers/location', method: 'GET' as const },
    { name: 'Booking Trends', path: '/stats/bookings/trends', method: 'GET' as const },
  ];

  for (const endpoint of publicEndpoints) {
    const result = await testEndpoint(
      endpoint.name,
      `${BASE_URL}${endpoint.path}`,
      adminToken, // Token not required but won't hurt
      endpoint.method
    );

    if (result.success) {
      log(`✅ ${endpoint.name}`, colors.green);
      log(`   Status: ${result.statusCode}`, colors.cyan);
      passed++;
    } else {
      log(`❌ ${endpoint.name}`, colors.red);
      log(`   Status: ${result.statusCode || 'N/A'}`, colors.yellow);
      if (result.error) {
        log(`   Error: ${result.error}`, colors.yellow);
      }
      failed++;
    }
  }

  // Summary
  log('\n' + '='.repeat(80), colors.cyan);
  log('📊 TEST SUMMARY', colors.bright);
  log('='.repeat(80), colors.cyan);
  log(`✅ Passed: ${passed}`, colors.green);
  log(`❌ Failed: ${failed}`, colors.red);
  log(`📈 Total: ${passed + failed}`, colors.cyan);
  log(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`, colors.cyan);
  
  if (failed === 0) {
    log('\n🎉 All tests passed!', colors.green);
  } else {
    log('\n⚠️  Some tests failed', colors.yellow);
  }
  log('='.repeat(80), colors.cyan);
}

runTests().catch(console.error);
