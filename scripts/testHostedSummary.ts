/**
 * Comprehensive Hosted Backend Test Summary
 * Tests all endpoints without requiring admin authentication
 */

import axios from 'axios';

const BASE_URL = 'https://spana-server-5bhu.onrender.com';

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

interface TestResult {
  name: string;
  path: string;
  method: string;
  success: boolean;
  statusCode?: number;
  responseTime?: number;
  data?: any;
  error?: string;
}

async function testEndpoint(name: string, path: string, method: 'GET' | 'POST' = 'GET', data?: any, expectedStatus?: number[]): Promise<TestResult> {
  const startTime = Date.now();
  try {
    const config: any = {
      method,
      url: `${BASE_URL}${path}`,
      timeout: 30000,
      validateStatus: () => true
    };

    if (data && method === 'POST') {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }

    const response = await axios(config);
    const responseTime = Date.now() - startTime;
    
    const isSuccess = expectedStatus 
      ? expectedStatus.includes(response.status)
      : response.status >= 200 && response.status < 400;

    return {
      name,
      path,
      method,
      success: isSuccess,
      statusCode: response.status,
      responseTime,
      data: response.data
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      name,
      path,
      method,
      success: false,
      statusCode: error.response?.status,
      responseTime,
      error: error.message
    };
  }
}

async function runTests() {
  log('\n🧪 COMPREHENSIVE HOSTED BACKEND TEST SUMMARY\n', colors.bright);
  log('='.repeat(80), colors.cyan);
  log(`Base URL: ${BASE_URL}\n`, colors.cyan);

  const results: TestResult[] = [];

  // Health & Status
  log('📋 Testing Health & Status Endpoints\n', colors.bright);
  results.push(await testEndpoint('Health Check', '/health', 'GET', undefined, [200]));
  
  // Authentication Endpoints
  log('📋 Testing Authentication Endpoints\n', colors.bright);
  results.push(await testEndpoint('Register (validation)', '/auth/register', 'POST', {}, [400, 422]));
  results.push(await testEndpoint('Login (validation)', '/auth/login', 'POST', {}, [400, 401]));
  
  // Services
  log('📋 Testing Service Endpoints\n', colors.bright);
  results.push(await testEndpoint('Get All Services', '/services', 'GET', undefined, [200]));
  results.push(await testEndpoint('Discover Services', '/services/discover', 'GET', undefined, [200]));
  
  // Stats
  log('📋 Testing Stats Endpoints\n', colors.bright);
  results.push(await testEndpoint('Platform Stats', '/stats/platform', 'GET', undefined, [200]));
  results.push(await testEndpoint('Provider Stats by Location', '/stats/providers/location', 'GET', undefined, [200]));
  results.push(await testEndpoint('Booking Trends', '/stats/bookings/trends', 'GET', undefined, [200]));
  
  // Users
  log('📋 Testing User Endpoints\n', colors.bright);
  results.push(await testEndpoint('Get All Providers', '/users/providers/all', 'GET', undefined, [200]));
  
  // Admin Endpoints (should require auth)
  log('📋 Testing Admin Endpoints (Auth Required)\n', colors.bright);
  results.push(await testEndpoint('Admin Users', '/admin/users', 'GET', undefined, [401, 403]));
  results.push(await testEndpoint('Admin Bookings', '/admin/bookings', 'GET', undefined, [401, 403]));
  results.push(await testEndpoint('Admin Services', '/admin/services', 'GET', undefined, [401, 403]));
  results.push(await testEndpoint('Admin Applications', '/admin/applications', 'GET', undefined, [401, 403]));
  
  // Application Endpoints
  log('📋 Testing Application Endpoints\n', colors.bright);
  results.push(await testEndpoint('Request Admin OTP', '/admin/otp/request', 'POST', { email: 'test@example.com' }, [400, 404]));
  
  // Print Results
  log('\n' + '='.repeat(80), colors.cyan);
  log('📊 TEST RESULTS', colors.bright);
  log('='.repeat(80), colors.cyan);

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgResponseTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length;

  log(`\n✅ Passed: ${passed}`, colors.green);
  log(`❌ Failed: ${failed}`, colors.red);
  log(`📈 Total: ${results.length}`, colors.cyan);
  log(`⏱️  Average Response Time: ${avgResponseTime.toFixed(0)}ms`, colors.cyan);
  log(`📊 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`, colors.cyan);

  // Detailed Results
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    const statusText = result.statusCode ? `(${result.statusCode})` : '';
    const timeText = result.responseTime ? `${result.responseTime}ms` : 'N/A';
    
    log(`${icon} ${result.name}`, result.success ? colors.green : colors.red);
    log(`   ${result.method} ${result.path}`, colors.cyan);
    log(`   Status: ${result.statusCode || 'N/A'} ${statusText}`, colors.yellow);
    log(`   Response Time: ${timeText}`, colors.yellow);
    
    if (result.error) {
      log(`   Error: ${result.error}`, colors.red);
    }
    
    if (result.data && typeof result.data === 'object' && !result.error) {
      const dataStr = JSON.stringify(result.data);
      const preview = dataStr.length > 150 ? dataStr.substring(0, 150) + '...' : dataStr;
      log(`   Response: ${preview}`, colors.cyan);
    }
    
    log('');
  });

  // Summary
  log('='.repeat(80), colors.cyan);
  if (failed === 0) {
    log('🎉 All tests passed!', colors.green);
  } else {
    log('⚠️  Some tests failed - check details above', colors.yellow);
  }
  log('='.repeat(80), colors.cyan);
  
  // Backend Status
  log('\n📋 BACKEND STATUS', colors.bright);
  log('='.repeat(80), colors.cyan);
  const healthResult = results.find(r => r.name === 'Health Check');
  if (healthResult && healthResult.success && healthResult.data) {
    log(`✅ Backend is online and healthy`, colors.green);
    if (healthResult.data.database) {
      log(`   Database: ${healthResult.data.database}`, colors.cyan);
    }
    if (healthResult.data.uptime) {
      const uptimeHours = (healthResult.data.uptime / 3600).toFixed(1);
      log(`   Uptime: ${uptimeHours} hours`, colors.cyan);
    }
  }
  log('='.repeat(80), colors.cyan);
}

runTests().catch(console.error);
