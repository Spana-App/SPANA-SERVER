/**
 * End-to-End API Testing Script
 * Tests all public website endpoints and verifies responses
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5003';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  responseTime?: number;
  statusCode?: number;
}

const results: TestResult[] = [];

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testEndpoint(name: string, url: string, expectedStatus: number = 200): Promise<TestResult> {
  const startTime = Date.now();
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: () => true // Don't throw on any status
    });
    
    const responseTime = Date.now() - startTime;
    const passed = response.status === expectedStatus && response.data !== undefined;
    
    if (!passed) {
      return {
        name,
        passed: false,
        error: `Expected status ${expectedStatus}, got ${response.status}. Data: ${JSON.stringify(response.data).substring(0, 100)}`,
        responseTime,
        statusCode: response.status
      };
    }
    
    return {
      name,
      passed: true,
      responseTime,
      statusCode: response.status
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error.response 
      ? `Status ${error.response.status}: ${JSON.stringify(error.response.data).substring(0, 200)}`
      : error.code === 'ECONNREFUSED'
      ? 'Connection refused - Server may not be running'
      : error.code === 'ETIMEDOUT'
      ? 'Request timeout'
      : error.message || 'Unknown error';
    
    return {
      name,
      passed: false,
      error: errorMessage,
      responseTime,
      statusCode: error.response?.status
    };
  }
}

async function runTests() {
  log('🧪 Starting End-to-End API Tests', colors.blue);
  console.log('');
  
  // Test 1: Health Check
  log('📋 Testing Health Endpoint...', colors.cyan);
  results.push(await testEndpoint('Health Check', `${BASE_URL}/health`));
  
  // Test 2: Platform Stats
  log('📋 Testing Platform Stats...', colors.cyan);
  results.push(await testEndpoint('Platform Stats', `${BASE_URL}/stats/platform`));
  
  // Test 3: Service Categories
  log('📋 Testing Service Categories...', colors.cyan);
  results.push(await testEndpoint('Service Categories', `${BASE_URL}/stats/services/categories`));
  
  // Test 4: Top Providers
  log('📋 Testing Top Providers...', colors.cyan);
  results.push(await testEndpoint('Top Providers', `${BASE_URL}/stats/providers/top?limit=5`));
  
  // Test 5: Providers by Location
  log('📋 Testing Providers by Location...', colors.cyan);
  results.push(await testEndpoint('Providers by Location', `${BASE_URL}/stats/providers/location`));
  
  // Test 6: Booking Trends
  log('📋 Testing Booking Trends...', colors.cyan);
  results.push(await testEndpoint('Booking Trends', `${BASE_URL}/stats/bookings/trends`));
  
  // Test 7: Revenue Stats
  log('📋 Testing Revenue Stats...', colors.cyan);
  results.push(await testEndpoint('Revenue Stats', `${BASE_URL}/stats/revenue`));
  
  // Test 8: Get All Services
  log('📋 Testing Get All Services...', colors.cyan);
  results.push(await testEndpoint('Get All Services', `${BASE_URL}/services?limit=5`));
  
  // Test 9: Get Services by Category
  log('📋 Testing Services by Category...', colors.cyan);
  results.push(await testEndpoint('Services by Category', `${BASE_URL}/services?category=Plumbing&limit=3`));
  
  // Test 10: Get All Providers
  log('📋 Testing Get All Providers...', colors.cyan);
  results.push(await testEndpoint('Get All Providers', `${BASE_URL}/users/providers?limit=5`));
  
  // Test 11: Get Providers by Category
  log('📋 Testing Providers by Category...', colors.cyan);
  results.push(await testEndpoint('Providers by Category', `${BASE_URL}/users/providers?category=Plumbing&limit=3`));
  
  // Print Results
  console.log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
  log('📊 TEST RESULTS', colors.blue);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
  console.log('');
  
  let passedCount = 0;
  let failedCount = 0;
  
  results.forEach((result, index) => {
    if (result.passed) {
      log(`✅ ${index + 1}. ${result.name}`, colors.green);
      log(`   Status: ${result.statusCode} | Time: ${result.responseTime}ms`, colors.reset);
      passedCount++;
    } else {
      log(`❌ ${index + 1}. ${result.name}`, colors.red);
      log(`   Status: ${result.statusCode || 'N/A'} | Time: ${result.responseTime}ms`, colors.reset);
      log(`   Error: ${result.error}`, colors.red);
      failedCount++;
    }
    console.log('');
  });
  
  // Summary
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
  log('📈 SUMMARY', colors.blue);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
  console.log('');
  log(`Total Tests: ${results.length}`, colors.reset);
  log(`✅ Passed: ${passedCount}`, colors.green);
  log(`❌ Failed: ${failedCount}`, failedCount > 0 ? colors.red : colors.reset);
  console.log('');
  
  const successRate = ((passedCount / results.length) * 100).toFixed(1);
  log(`Success Rate: ${successRate}%`, successRate === '100.0' ? colors.green : colors.yellow);
  console.log('');
  
  if (failedCount === 0) {
    log('🎉 All tests passed! System is working correctly.', colors.green);
    process.exit(0);
  } else {
    log('⚠️  Some tests failed. Please check the errors above.', colors.yellow);
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error(colors.red + '❌ Test runner error:' + colors.reset, error);
  process.exit(1);
});

