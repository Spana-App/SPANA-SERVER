/**
 * Test Booking Endpoints on Localhost
 * Tests both payload formats: serviceId and serviceTitle + requiredSkills
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5003';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name: string, passed: boolean, details?: string) {
  const icon = passed ? '✅' : '❌';
  const color = passed ? colors.green : colors.red;
  log(`${icon} ${name}`, color);
  if (details) {
    log(`   ${details}`, colors.cyan);
  }
}

async function testBookingEndpoints() {
  log('\n🧪 Testing Booking Endpoints on Localhost\n', colors.blue);
  log(`📍 API Base URL: ${API_BASE_URL}\n`, colors.cyan);

  let customerToken: string = '';
  let serviceId: string = '';

  try {
    // Step 1: Health Check
    log('1. Testing Health Check...', colors.yellow);
    try {
      const healthRes = await axios.get(`${API_BASE_URL}/health`);
      logTest('Health Check', healthRes.status === 200, `Status: ${healthRes.status}`);
    } catch (error: any) {
      logTest('Health Check', false, error.message);
      return;
    }

    // Step 2: Register Test Customer
    log('\n2. Registering Test Customer...', colors.yellow);
    const testEmail = `test_booking_${Date.now()}@test.com`;
    try {
      const registerRes = await axios.post(`${API_BASE_URL}/auth/register`, {
        email: testEmail,
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'Customer',
        role: 'customer',
        phone: '+27123456789'
      });
      logTest('Customer Registration', registerRes.status === 201 || registerRes.status === 200);
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        logTest('Customer Registration', true, 'User already exists (will use existing)');
      } else {
        logTest('Customer Registration', false, error.response?.data?.message || error.message);
      }
    }

    // Step 3: Login
    log('\n3. Logging in...', colors.yellow);
    try {
      const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: testEmail,
        password: 'Test123!@#'
      });
      customerToken = loginRes.data.token;
      logTest('Login', !!customerToken, `Token received: ${customerToken.substring(0, 20)}...`);
    } catch (error: any) {
      logTest('Login', false, error.response?.data?.message || error.message);
      return;
    }

    // Step 4: Get Available Services
    log('\n4. Getting Available Services...', colors.yellow);
    try {
      const servicesRes = await axios.get(`${API_BASE_URL}/services`, {
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      const services = Array.isArray(servicesRes.data) ? servicesRes.data : servicesRes.data.services || [];
      const approvedService = services.find((s: any) => s.adminApproved && s.status === 'active');
      
      if (approvedService) {
        serviceId = approvedService.id;
        logTest('Get Services', true, `Found approved service: ${approvedService.title} (ID: ${serviceId})`);
      } else {
        logTest('Get Services', true, `Found ${services.length} services, but none approved. Will test with serviceTitle instead.`);
      }
    } catch (error: any) {
      logTest('Get Services', false, error.response?.data?.message || error.message);
    }

    // Step 5: Test Booking with serviceId (if available)
    if (serviceId) {
      log('\n5. Testing Booking Creation with serviceId...', colors.yellow);
      const bookingPayload1 = {
        serviceId: serviceId,
        date: new Date().toISOString(),
        time: '10:00',
        location: {
          type: 'Point',
          coordinates: [28.0473, -26.2041], // [lng, lat] - Johannesburg
          address: '123 Test Street, Johannesburg'
        },
        notes: 'Test booking with serviceId',
        estimatedDurationMinutes: 60,
        jobSize: 'medium',
        customPrice: null
      };

      try {
        const bookingRes = await axios.post(
          `${API_BASE_URL}/bookings`,
          bookingPayload1,
          {
            headers: { Authorization: `Bearer ${customerToken}` }
          }
        );

        logTest('Create Booking (serviceId)', bookingRes.status === 201, `Booking ID: ${bookingRes.data.booking?.id || bookingRes.data.id}`);
        log('   Payload sent:', colors.cyan);
        console.log(JSON.stringify(bookingPayload1, null, 2));
        log('   Response:', colors.cyan);
        console.log(JSON.stringify({
          id: bookingRes.data.booking?.id || bookingRes.data.id,
          status: bookingRes.data.booking?.status || bookingRes.data.status,
          calculatedPrice: bookingRes.data.booking?.calculatedPrice || bookingRes.data.calculatedPrice
        }, null, 2));
      } catch (error: any) {
        logTest('Create Booking (serviceId)', false, error.response?.data?.message || error.message);
        if (error.response?.data) {
          log('   Error details:', colors.red);
          console.log(JSON.stringify(error.response.data, null, 2));
        }
      }
    } else {
      log('\n5. Skipping serviceId test (no approved service found)', colors.yellow);
    }

    // Step 6: Test Booking with serviceTitle + requiredSkills
    log('\n6. Testing Booking Creation with serviceTitle + requiredSkills...', colors.yellow);
    const bookingPayload2 = {
      serviceTitle: 'Plumbing Service',
      requiredSkills: ['plumbing', 'repair'],
      date: new Date().toISOString(),
      time: '10:00',
      location: {
        type: 'Point',
        coordinates: [28.0473, -26.2041], // [lng, lat] - Johannesburg
        address: '123 Test Street, Johannesburg'
      },
      notes: 'Test booking with serviceTitle',
      estimatedDurationMinutes: 60,
      jobSize: 'medium',
      customPrice: null
    };

    try {
      const bookingRes = await axios.post(
        `${API_BASE_URL}/bookings`,
        bookingPayload2,
        {
          headers: { Authorization: `Bearer ${customerToken}` }
        }
      );

      logTest('Create Booking (serviceTitle)', bookingRes.status === 201, 
        bookingRes.data?.queued ? 'Queued (no providers available)' : `Booking ID: ${bookingRes.data.booking?.id || bookingRes.data.id}`);
      log('   Payload sent:', colors.cyan);
      console.log(JSON.stringify(bookingPayload2, null, 2));
      log('   Response:', colors.cyan);
      console.log(JSON.stringify({
        status: bookingRes.status,
        queued: bookingRes.data.queued,
        id: bookingRes.data.booking?.id || bookingRes.data.id,
        message: bookingRes.data.message
      }, null, 2));
    } catch (error: any) {
      logTest('Create Booking (serviceTitle)', false, error.response?.data?.message || error.message);
      if (error.response?.data) {
        log('   Error details:', colors.red);
        console.log(JSON.stringify(error.response.data, null, 2));
      }
    }

    // Step 7: Test Error Cases
    log('\n7. Testing Error Cases...', colors.yellow);

    // Test 7.1: Missing location
    log('\n7.1. Testing missing location...', colors.yellow);
    try {
      await axios.post(
        `${API_BASE_URL}/bookings`,
        {
          serviceId: serviceId || 'test_id',
          date: new Date().toISOString(),
          time: '10:00'
        },
        {
          headers: { Authorization: `Bearer ${customerToken}` }
        }
      );
      logTest('Missing Location Validation', false, 'Should have returned 400 error');
    } catch (error: any) {
      const is400 = error.response?.status === 400;
      logTest('Missing Location Validation', is400, 
        is400 ? 'Correctly rejected' : `Unexpected status: ${error.response?.status}`);
    }

    // Test 7.2: Invalid coordinates (0,0)
    log('\n7.2. Testing invalid coordinates (0,0)...', colors.yellow);
    try {
      await axios.post(
        `${API_BASE_URL}/bookings`,
        {
          serviceId: serviceId || 'test_id',
          date: new Date().toISOString(),
          time: '10:00',
          location: {
            type: 'Point',
            coordinates: [0, 0],
            address: 'Invalid Location'
          }
        },
        {
          headers: { Authorization: `Bearer ${customerToken}` }
        }
      );
      logTest('Invalid Coordinates Validation', false, 'Should have returned 400 error');
    } catch (error: any) {
      const is400 = error.response?.status === 400;
      logTest('Invalid Coordinates Validation', is400, 
        is400 ? 'Correctly rejected invalid coordinates' : `Unexpected status: ${error.response?.status}`);
    }

    // Test 7.3: Missing both serviceId and serviceTitle
    log('\n7.3. Testing missing both serviceId and serviceTitle...', colors.yellow);
    try {
      await axios.post(
        `${API_BASE_URL}/bookings`,
        {
          date: new Date().toISOString(),
          time: '10:00',
          location: {
            type: 'Point',
            coordinates: [28.0473, -26.2041],
            address: 'Test Address'
          }
        },
        {
          headers: { Authorization: `Bearer ${customerToken}` }
        }
      );
      logTest('Missing Service ID/Title Validation', false, 'Should have returned 400 error');
    } catch (error: any) {
      const is400 = error.response?.status === 400;
      const correctMessage = error.response?.data?.message?.includes('serviceId') || 
                            error.response?.data?.message?.includes('serviceTitle');
      logTest('Missing Service ID/Title Validation', is400 && correctMessage, 
        is400 && correctMessage ? 'Correctly rejected' : `Status: ${error.response?.status}, Message: ${error.response?.data?.message}`);
    }

    // Summary
    log('\n' + '='.repeat(60), colors.blue);
    log('✅ Testing Complete!', colors.green);
    log('='.repeat(60) + '\n', colors.blue);

  } catch (error: any) {
    log('\n❌ Test Suite Failed:', colors.red);
    log(error.message, colors.red);
    if (error.response) {
      log('Response:', colors.red);
      console.log(JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testBookingEndpoints();
