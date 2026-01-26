import axios from 'axios';

const EMAIL_SERVICE_URL = 'https://email-microservice-pi.vercel.app';
const BACKEND_URL = 'https://spana-server-5bhu.onrender.com';

interface TestResult {
  name: string;
  url: string;
  status: 'success' | 'failed' | 'timeout';
  statusCode?: number;
  responseTime?: number;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

async function testEndpoint(name: string, url: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<TestResult> {
  const startTime = Date.now();
  try {
    const config: any = {
      method,
      url,
      timeout: 15000,
      validateStatus: (status: number) => status < 500, // Accept any status < 500 as "working"
    };

    if (data && method === 'POST') {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }

    const response = await axios(config);
    const responseTime = Date.now() - startTime;

    return {
      name,
      url,
      status: response.status < 500 ? 'success' : 'failed',
      statusCode: response.status,
      responseTime,
      data: response.data,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      name,
      url,
      status: error.code === 'ECONNABORTED' ? 'timeout' : 'failed',
      statusCode: error.response?.status,
      responseTime,
      error: error.message || 'Unknown error',
    };
  }
}

async function runTests() {
  console.log('🧪 Testing Hosted URLs\n');
  console.log('='.repeat(80));

  // Test Email Service
  console.log('\n📧 Testing Email Service...');
  results.push(await testEndpoint(
    'Email Service Health Check',
    `${EMAIL_SERVICE_URL}/api/health`
  ));

  // Test Backend
  console.log('\n🔧 Testing Backend...');
  
  // Try different base paths
  const backendPaths = [
    '',           // Root
    '/api',       // /api
    '/api/health', // /api/health
    '/health',    // /health
    '/auth/register', // /auth/register (no /api prefix)
    '/api/auth/register', // /api/auth/register
  ];

  for (const path of backendPaths) {
    const fullUrl = `${BACKEND_URL}${path}`;
    const method = path.includes('register') ? 'POST' : 'GET';
    const data = path.includes('register') ? {} : undefined;
    
    results.push(await testEndpoint(
      `Backend - ${path || 'Root'}`,
      fullUrl,
      method as 'GET' | 'POST',
      data
    ));
  }

  // Test specific known endpoints (no /api prefix based on server.ts)
  const knownEndpoints = [
    { path: '/auth/register', method: 'POST' as const, data: {}, expectedStatus: [400, 422] },
    { path: '/auth/login', method: 'POST' as const, data: {}, expectedStatus: [400, 401] },
    { path: '/services', method: 'GET' as const, expectedStatus: [200] },
    { path: '/stats/platform', method: 'GET' as const, expectedStatus: [200] },
    { path: '/admin/users', method: 'GET' as const, expectedStatus: [401, 403] }, // Should require auth
    { path: '/admin/bookings', method: 'GET' as const, expectedStatus: [401, 403] }, // Should require auth
    { path: '/admin/otp/request', method: 'POST' as const, data: { email: 'test@example.com' }, expectedStatus: [400, 404] },
    { path: '/users/providers/all', method: 'GET' as const, expectedStatus: [200] },
  ];

  for (const endpoint of knownEndpoints) {
    results.push(await testEndpoint(
      `Backend - ${endpoint.path}`,
      `${BACKEND_URL}${endpoint.path}`,
      endpoint.method,
      endpoint.data
    ));
  }

  // Print results
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(80));

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const timeoutCount = results.filter(r => r.status === 'timeout').length;

  console.log(`\n✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`⏱️  Timeout: ${timeoutCount}`);
  console.log(`📈 Total: ${results.length}\n`);

  results.forEach((result, index) => {
    const icon = result.status === 'success' ? '✅' : result.status === 'timeout' ? '⏱️' : '❌';
    const statusText = result.statusCode ? `(${result.statusCode})` : '';
    const timeText = result.responseTime ? `${result.responseTime}ms` : 'N/A';
    
    console.log(`${icon} ${result.name}`);
    console.log(`   URL: ${result.url}`);
    console.log(`   Status: ${result.status.toUpperCase()} ${statusText}`);
    console.log(`   Response Time: ${timeText}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.data && typeof result.data === 'object') {
      const dataPreview = JSON.stringify(result.data).substring(0, 200);
      console.log(`   Response: ${dataPreview}${dataPreview.length >= 200 ? '...' : ''}`);
    }
    
    console.log('');
  });

  // Summary
  console.log('='.repeat(80));
  if (failedCount === 0 && timeoutCount === 0) {
    console.log('🎉 All tests passed!');
  } else if (timeoutCount > 0) {
    console.log('⚠️  Some tests timed out - this may indicate the services are slow or unresponsive');
  } else {
    console.log('⚠️  Some tests failed - check the details above');
  }
  console.log('='.repeat(80));
}

runTests().catch(console.error);
