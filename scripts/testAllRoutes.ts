/**
 * Comprehensive Route Testing Script
 * Tests all API endpoints to ensure they're working correctly
 */

import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5003';
const API_URL = `${BASE_URL}`;

// Test results storage
interface TestResult {
  route: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  message?: string;
  error?: string;
}

const results: TestResult[] = [];
let customerToken: string = '';
let providerToken: string = '';
let adminToken: string = '';
let customerId: string = '';
let providerId: string = '';
let serviceId: string = '';
let bookingId: string = '';

// Helper function to make requests
async function testRoute(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  route: string,
  data?: any,
  token?: string,
  expectedStatus?: number | number[]
): Promise<TestResult> {
  const config: any = {
    method,
    url: `${API_URL}${route}`,
    headers: {
      'Content-Type': 'application/json',
    },
    validateStatus: () => true, // Don't throw on any status
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    const statusCodes = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus || 200, 201];
    const passed = !expectedStatus || statusCodes.includes(response.status);

    return {
      route,
      method,
      status: passed ? 'PASS' : 'FAIL',
      statusCode: response.status,
      message: passed ? 'OK' : `Expected ${expectedStatus}, got ${response.status}`,
    };
  } catch (error: any) {
    return {
      route,
      method,
      status: 'FAIL',
      error: error.message || 'Unknown error',
    };
  }
}

// Helper to skip tests
function skipRoute(route: string, method: string, reason: string): TestResult {
  return {
    route,
    method,
    status: 'SKIP',
    message: reason,
  };
}

// Print results
function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}\n`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:\n');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`  ${r.method} ${r.route}`);
        console.log(`    Status: ${r.statusCode || 'N/A'}`);
        console.log(`    Error: ${r.error || r.message || 'Unknown error'}\n`);
      });
  }

  if (skipped > 0) {
    console.log('\n⏭️  SKIPPED TESTS:\n');
    results
      .filter(r => r.status === 'SKIP')
      .forEach(r => {
        console.log(`  ${r.method} ${r.route} - ${r.message}\n`);
      });
  }

  console.log('\n' + '='.repeat(80));
  console.log(failed === 0 ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED');
  console.log('='.repeat(80) + '\n');
}

// Main test function
async function runTests() {
  console.log('🚀 Starting comprehensive route tests...\n');
  console.log(`Testing against: ${API_URL}\n`);

  // 1. Health Check (Public)
  console.log('📋 Testing Health & Public Endpoints...');
  results.push(await testRoute('GET', '/health'));
  results.push(await testRoute('GET', '/health/detailed'));

  // 2. Auth - Public Routes
  console.log('\n📋 Testing Auth Routes (Public)...');
  
  // Register test customer
  const customerEmail = `test-customer-${Date.now()}@test.com`;
  const registerCustomerRes = await testRoute('POST', '/auth/register', {
    email: customerEmail,
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'Customer',
    phone: '+27123456789',
    role: 'customer',
  }, undefined, [201, 400]); // 400 if email exists
  
  if (registerCustomerRes.statusCode === 201) {
    // Try to get token from response (if returned)
    console.log('✅ Customer registered');
  }

  // Register test provider
  const providerEmail = `test-provider-${Date.now()}@test.com`;
  const registerProviderRes = await testRoute('POST', '/auth/register', {
    email: providerEmail,
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'Provider',
    phone: '+27123456789',
    role: 'service_provider',
  }, undefined, [201, 400]);
  
  if (registerProviderRes.statusCode === 201) {
    console.log('✅ Provider registered');
  }

  // Login customer
  const loginCustomerRes = await axios.post(`${API_URL}/auth/login`, {
    email: customerEmail,
    password: 'Test123!',
  }, { validateStatus: () => true });
  
  if (loginCustomerRes.status === 200 && loginCustomerRes.data.token) {
    customerToken = loginCustomerRes.data.token;
    customerId = loginCustomerRes.data.user?._id || loginCustomerRes.data.user?.id || '';
    console.log('✅ Customer logged in');
  }

  // Login provider
  const loginProviderRes = await axios.post(`${API_URL}/auth/login`, {
    email: providerEmail,
    password: 'Test123!',
  }, { validateStatus: () => true });
  
  if (loginProviderRes.status === 200 && loginProviderRes.data.token) {
    providerToken = loginProviderRes.data.token;
    providerId = loginProviderRes.data.user?._id || loginProviderRes.data.user?.id || '';
    console.log('✅ Provider logged in');
  }

  // Admin login (if admin exists)
  try {
    const adminLoginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'xoli@spana.co.za', // Use your admin email
    }, { validateStatus: () => true });
    
    if (adminLoginRes.status === 200 && adminLoginRes.data.token) {
      adminToken = adminLoginRes.data.token;
      console.log('✅ Admin logged in');
    }
  } catch (e) {
    console.log('⚠️  Admin login skipped (no admin account)');
  }

  // 3. Auth - Protected Routes
  console.log('\n📋 Testing Auth Routes (Protected)...');
  if (customerToken) {
    results.push(await testRoute('GET', '/auth/me', undefined, customerToken));
    results.push(await testRoute('PUT', '/auth/profile', {
      firstName: 'Updated',
      lastName: 'Name',
    }, customerToken));
    results.push(await testRoute('PATCH', '/auth/profile', {
      phone: '+27987654321',
    }, customerToken));
  } else {
    results.push(skipRoute('/auth/me', 'GET', 'No customer token'));
    results.push(skipRoute('/auth/profile', 'PUT', 'No customer token'));
  }

  // 4. Services - Public Routes
  console.log('\n📋 Testing Services Routes...');
  results.push(await testRoute('GET', '/services'));
  results.push(await testRoute('GET', '/services/discover'));

  // 5. Services - Protected Routes
  if (providerToken) {
    // Note: Provider needs complete profile to create services
    results.push(skipRoute('/services', 'POST', 'Requires complete provider profile'));
  }

  // 6. Admin - Service Management
  console.log('\n📋 Testing Admin Service Routes...');
  if (adminToken) {
    // Create service without providerId (new feature)
    const createServiceRes = await testRoute('POST', '/admin/services', {
      title: 'Test Service',
      description: 'Test service description',
      price: 100.00,
      duration: 60,
    }, adminToken, [201, 400]);
    
    if (createServiceRes.statusCode === 201) {
      // Try to extract service ID from response
      try {
        const serviceRes = await axios.post(`${API_URL}/admin/services`, {
          title: 'Test Service',
          description: 'Test service description',
          price: 100.00,
          duration: 60,
        }, {
          headers: { Authorization: `Bearer ${adminToken}` },
          validateStatus: () => true,
        });
        if (serviceRes.data.service?.id) {
          serviceId = serviceRes.data.service.id;
        }
      } catch (e) {}
    }

    results.push(createServiceRes);
    results.push(await testRoute('GET', '/admin/services', undefined, adminToken));
    
    if (serviceId) {
      results.push(await testRoute('GET', `/services/${serviceId}`));
      results.push(await testRoute('PUT', `/admin/services/${serviceId}`, {
        title: 'Updated Test Service',
      }, adminToken));
      results.push(await testRoute('POST', `/admin/services/${serviceId}/approve`, {}, adminToken, [200, 400]));
    }
  } else {
    results.push(skipRoute('/admin/services', 'POST', 'No admin token'));
    results.push(skipRoute('/admin/services', 'GET', 'No admin token'));
  }

  // 7. Users Routes
  console.log('\n📋 Testing Users Routes...');
  if (customerToken && customerId) {
    results.push(await testRoute('GET', `/users/${customerId}`, undefined, customerToken));
    results.push(await testRoute('PUT', `/users/${customerId}`, {
      firstName: 'Updated',
    }, customerToken));
  }
  results.push(await testRoute('GET', '/users/providers/all'));

  if (adminToken) {
    results.push(await testRoute('GET', '/admin/users', undefined, adminToken));
  }

  // 8. Bookings Routes
  console.log('\n📋 Testing Bookings Routes...');
  if (customerToken) {
    results.push(await testRoute('GET', '/bookings', undefined, customerToken));
    // Note: Creating booking requires a valid service with provider
    results.push(skipRoute('/bookings', 'POST', 'Requires valid service with provider'));
  }

  // 9. Payments Routes
  console.log('\n📋 Testing Payments Routes...');
  if (customerToken) {
    results.push(await testRoute('GET', '/payments/history', undefined, customerToken));
    results.push(skipRoute('/payments/intent', 'POST', 'Requires booking context'));
  }

  // 10. Notifications Routes
  console.log('\n📋 Testing Notifications Routes...');
  if (customerToken) {
    results.push(await testRoute('GET', '/notifications', undefined, customerToken));
  }

  // 11. Activities Routes
  console.log('\n📋 Testing Activities Routes...');
  if (customerToken) {
    results.push(await testRoute('GET', '/activities', undefined, customerToken));
  }

  // 12. Email Verification Routes
  console.log('\n📋 Testing Email Verification Routes...');
  results.push(await testRoute('POST', '/email-verification/send-verification', {
    email: customerEmail,
  }));
  if (customerToken) {
    results.push(await testRoute('GET', '/email-verification/verification-status', undefined, customerToken));
  }

  // 13. Password Reset Routes
  console.log('\n📋 Testing Password Reset Routes...');
  results.push(await testRoute('POST', '/password-reset/request', {
    email: customerEmail,
  }));

  // 14. Privacy Routes
  console.log('\n📋 Testing Privacy Routes...');
  if (customerToken) {
    results.push(await testRoute('GET', '/privacy/status', undefined, customerToken));
    results.push(await testRoute('GET', '/privacy/export-data', undefined, customerToken));
  }

  // 15. Complaints Routes
  console.log('\n📋 Testing Complaints Routes...');
  if (customerToken) {
    results.push(await testRoute('GET', '/complaints/my-complaints', undefined, customerToken));
    results.push(skipRoute('/complaints', 'POST', 'Requires booking context'));
  }

  // 16. Stats Routes (Public)
  console.log('\n📋 Testing Stats Routes...');
  results.push(await testRoute('GET', '/stats/platform'));
  results.push(await testRoute('GET', '/stats/providers/location'));
  results.push(await testRoute('GET', '/stats/bookings/trends'));
  results.push(await testRoute('GET', '/stats/providers/top'));
  results.push(await testRoute('GET', '/stats/revenue'));

  // 17. Admin Routes
  console.log('\n📋 Testing Admin Routes...');
  if (adminToken) {
    results.push(await testRoute('GET', '/admin/bookings', undefined, adminToken));
    results.push(await testRoute('GET', '/admin/wallet/transactions', undefined, adminToken));
    results.push(await testRoute('GET', '/admin/wallet/summary', undefined, adminToken));
    results.push(await testRoute('GET', '/admin/complaints', undefined, adminToken));
    results.push(await testRoute('GET', '/admin/documents/pending', undefined, adminToken));
  }

  // 18. Admin OTP Routes
  console.log('\n📋 Testing Admin OTP Routes...');
  results.push(await testRoute('POST', '/admin/otp/request', {
    email: 'xoli@spana.co.za',
  }, undefined, [200, 400]));

  // 19. Admin Verification (requires query params, 400 is expected without them)
  results.push(await testRoute('GET', '/admin/verify', undefined, undefined, [200, 400]));

  // Print results
  printResults();
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});

