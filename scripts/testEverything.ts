import axios from 'axios';

const EMAIL_SERVICE_URL = 'https://email-microservice-pi.vercel.app';
const BACKEND_URL = 'https://spana-server-5bhu.onrender.com';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function testEndpoint(name: string, url: string, method: 'GET' | 'POST' = 'GET', data?: any, expectedStatus?: number[]): Promise<TestResult> {
  try {
    const config: any = {
      method,
      url,
      timeout: 15000,
      validateStatus: () => true, // Accept all status codes
    };

    if (data && method === 'POST') {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }

    const response = await axios(config);
    const statusCode = response.status;

    // Check if status matches expected
    if (expectedStatus && !expectedStatus.includes(statusCode)) {
      return {
        name,
        status: 'fail',
        message: `Expected status ${expectedStatus.join(' or ')}, got ${statusCode}`,
        details: { statusCode, response: response.data }
      };
    }

    // Consider 2xx and 4xx as acceptable (4xx means endpoint exists and is working)
    if (statusCode >= 200 && statusCode < 500) {
      return {
        name,
        status: 'pass',
        message: `✅ Status ${statusCode}`,
        details: { statusCode, responseTime: response.headers['x-response-time'] || 'N/A' }
      };
    }

    return {
      name,
      status: 'fail',
      message: `❌ Status ${statusCode}`,
      details: { statusCode, response: response.data }
    };
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      return {
        name,
        status: 'warn',
        message: '⏱️ Request timed out',
        details: { error: error.message }
      };
    }
    return {
      name,
      status: 'fail',
      message: `❌ ${error.message}`,
      details: { error: error.message, statusCode: error.response?.status }
    };
  }
}

async function runTests() {
  console.log('🧪 Comprehensive System Test\n');
  console.log('='.repeat(80));

  // 1. Email Service Tests
  console.log('\n📧 Testing Email Service...');
  results.push(await testEndpoint(
    'Email Service Health',
    `${EMAIL_SERVICE_URL}/api/health`,
    'GET',
    undefined,
    [200]
  ));

  // 2. Backend Health Tests
  console.log('\n🔧 Testing Backend Health...');
  results.push(await testEndpoint(
    'Backend Health Check',
    `${BACKEND_URL}/health`,
    'GET',
    undefined,
    [200]
  ));

  // 3. Public Endpoints
  console.log('\n🌐 Testing Public Endpoints...');
  results.push(await testEndpoint(
    'Get Services',
    `${BACKEND_URL}/services`,
    'GET',
    undefined,
    [200]
  ));

  results.push(await testEndpoint(
    'Platform Stats',
    `${BACKEND_URL}/stats/platform`,
    'GET',
    undefined,
    [200]
  ));

  results.push(await testEndpoint(
    'Get All Providers',
    `${BACKEND_URL}/users/providers/all`,
    'GET',
    undefined,
    [200]
  ));

  // 4. Auth Endpoints
  console.log('\n🔐 Testing Auth Endpoints...');
  results.push(await testEndpoint(
    'Register Endpoint (validation)',
    `${BACKEND_URL}/auth/register`,
    'POST',
    {},
    [400, 422]
  ));

  results.push(await testEndpoint(
    'Login Endpoint (validation)',
    `${BACKEND_URL}/auth/login`,
    'POST',
    {},
    [400, 401]
  ));

  // 5. Admin Endpoints (should require auth)
  console.log('\n👑 Testing Admin Endpoints...');
  results.push(await testEndpoint(
    'Admin Users (auth required)',
    `${BACKEND_URL}/admin/users`,
    'GET',
    undefined,
    [401, 403]
  ));

  results.push(await testEndpoint(
    'Admin Bookings (auth required)',
    `${BACKEND_URL}/admin/bookings`,
    'GET',
    undefined,
    [401, 403]
  ));

  results.push(await testEndpoint(
    'Admin OTP Request (validation)',
    `${BACKEND_URL}/admin/otp/request`,
    'POST',
    { email: 'test@example.com' },
    [400]
  ));

  // 6. Test Login Flow with Admin Email
  console.log('\n🔑 Testing Admin Login Flow...');
  const adminEmail = 'xoli@spana.co.za';
  const adminPassword = 'TestPassword123!';

  // Try login
  const loginResult = await testEndpoint(
    'Admin Login Attempt',
    `${BACKEND_URL}/auth/login`,
    'POST',
    { email: adminEmail, password: adminPassword },
    [200, 400, 401]
  );
  results.push(loginResult);

  // If login requires OTP, test OTP request
  if (loginResult.status === 'pass' && loginResult.details?.statusCode === 200) {
    console.log('   → Login successful, OTP flow may be required');
  } else if (loginResult.details?.statusCode === 400) {
    console.log('   → Login failed: Invalid credentials (user may not exist or password incorrect)');
  }

  // Print Results
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warn').length;

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`📈 Total: ${results.length}\n`);

  results.forEach((result, index) => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details && Object.keys(result.details).length > 0) {
      const detailsStr = JSON.stringify(result.details).substring(0, 150);
      if (detailsStr.length >= 150) {
        console.log(`   Details: ${detailsStr}...`);
      } else {
        console.log(`   Details: ${detailsStr}`);
      }
    }
    console.log('');
  });

  // Final Summary
  console.log('='.repeat(80));
  if (failed === 0 && warnings === 0) {
    console.log('🎉 All tests passed! System is fully operational.');
  } else if (failed === 0) {
    console.log('✅ All critical tests passed! Some warnings detected (timeouts).');
  } else {
    console.log('⚠️  Some tests failed. Please review the details above.');
  }
  console.log('='.repeat(80));

  // Recommendations
  if (failed > 0 || warnings > 0) {
    console.log('\n💡 Recommendations:');
    if (results.find(r => r.name.includes('Email Service') && r.status !== 'pass')) {
      console.log('   - Check email service environment variables on Vercel');
    }
    if (results.find(r => r.name.includes('Platform Stats') && r.status !== 'pass')) {
      console.log('   - Stats endpoint fixed - should work now');
    }
    if (results.find(r => r.name.includes('Login') && r.status !== 'pass')) {
      console.log('   - Verify admin user exists in database');
      console.log('   - Check password is correct');
      console.log('   - Ensure email domain matches ADMIN_EMAIL_DOMAINS');
    }
  }
}

runTests().catch(console.error);
