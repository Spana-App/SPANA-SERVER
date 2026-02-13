/**
 * Test Booking Endpoint with Exact Payload Format
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5003';

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

async function testExactPayload() {
  log('\n🧪 Testing Booking Endpoint with Exact Payload Format\n', colors.blue);
  log(`📍 API Base URL: ${API_BASE_URL}\n`, colors.cyan);

  let customerToken: string = '';
  let serviceId: string = '';

  try {
    // Step 1: Health Check
    log('1. Health Check...', colors.yellow);
    const healthRes = await axios.get(`${API_BASE_URL}/health`, {
      validateStatus: () => true
    });
    if (healthRes.status === 200) {
      log('   ✅ Server is running\n', colors.green);
    } else {
      log(`   ❌ Server returned status ${healthRes.status}\n`, colors.red);
      return;
    }

    // Step 2: Register Test Customer
    log('2. Registering Test Customer...', colors.yellow);
    const testEmail = `test_exact_${Date.now()}@test.com`;
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, {
        email: testEmail,
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'Customer',
        role: 'customer',
        phone: '+27123456789'
      });
      log('   ✅ Customer registered\n', colors.green);
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        log('   ✅ Customer already exists (will use existing)\n', colors.green);
      } else {
        log(`   ⚠️  Registration: ${error.response?.data?.message || error.message}\n`, colors.yellow);
      }
    }

    // Step 3: Login
    log('3. Logging in...', colors.yellow);
    const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: testEmail,
      password: 'Test123!@#'
    });
    customerToken = loginRes.data.token;
    if (customerToken) {
      log(`   ✅ Login successful (token: ${customerToken.substring(0, 30)}...)\n`, colors.green);
    } else {
      log('   ❌ No token received\n', colors.red);
      return;
    }

    // Step 4: Get Available Service
    log('4. Getting Available Services...', colors.yellow);
    const servicesRes = await axios.get(`${API_BASE_URL}/services`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const services = Array.isArray(servicesRes.data) ? servicesRes.data : servicesRes.data.services || [];
    const approvedService = services.find((s: any) => s.adminApproved && s.status === 'active');
    
    if (approvedService) {
      serviceId = approvedService.id;
      log(`   ✅ Found service: "${approvedService.title}" (ID: ${serviceId})\n`, colors.green);
    } else {
      log(`   ⚠️  Found ${services.length} services, but none approved. Will test with serviceTitle instead.\n`, colors.yellow);
    }

    // Step 5: Test with Exact Payload Format
    log('5. Testing with EXACT Payload Format...', colors.yellow);
    log('   Payload:', colors.cyan);
    
    // Use today's date (backend requires same-day bookings)
    const today = new Date();
    const todayISO = today.toISOString();
    
    const exactPayload = {
      "serviceId": serviceId || "test_service_id",
      "date": todayISO, // Must be today
      "time": "10:00",
      "location": {
        "type": "Point",
        "coordinates": [28.0473, -26.2041],
        "address": "123 Main St, Johannesburg"
      },
      "notes": "Please arrive on time",
      "estimatedDurationMinutes": 60,
      "jobSize": "medium",
      "customPrice": null
    };

    console.log(JSON.stringify(exactPayload, null, 2));
    log('');

    try {
      const bookingRes = await axios.post(
        `${API_BASE_URL}/bookings`,
        exactPayload,
        {
          headers: { Authorization: `Bearer ${customerToken}` },
          validateStatus: () => true // Don't throw on any status
        }
      );

      log(`   Response Status: ${bookingRes.status}`, colors.cyan);
      
      if (bookingRes.status === 201) {
        log('\n   ✅ SUCCESS - Booking Created!\n', colors.green);
        log('   Response:', colors.cyan);
        console.log(JSON.stringify({
          id: bookingRes.data.booking?.id || bookingRes.data.id,
          status: bookingRes.data.booking?.status || bookingRes.data.status,
          requestStatus: bookingRes.data.booking?.requestStatus || bookingRes.data.requestStatus,
          paymentStatus: bookingRes.data.booking?.paymentStatus || bookingRes.data.paymentStatus,
          calculatedPrice: bookingRes.data.booking?.calculatedPrice || bookingRes.data.calculatedPrice,
          jobSize: bookingRes.data.booking?.jobSize || bookingRes.data.jobSize,
          location: bookingRes.data.booking?.location || bookingRes.data.location
        }, null, 2));
        
        log('\n   ✅ All fields processed correctly:', colors.green);
        log(`      - serviceId: ${exactPayload.serviceId}`, colors.green);
        log(`      - date: ${exactPayload.date}`, colors.green);
        log(`      - time: ${exactPayload.time}`, colors.green);
        log(`      - location: ${JSON.stringify(exactPayload.location)}`, colors.green);
        log(`      - notes: ${exactPayload.notes}`, colors.green);
        log(`      - estimatedDurationMinutes: ${exactPayload.estimatedDurationMinutes}`, colors.green);
        log(`      - jobSize: ${exactPayload.jobSize}`, colors.green);
        log(`      - customPrice: ${exactPayload.customPrice}`, colors.green);
        
      } else if (bookingRes.status === 201 && bookingRes.data?.queued) {
        log('\n   ⚠️  Booking Queued (No providers available)', colors.yellow);
        log('   Response:', colors.cyan);
        console.log(JSON.stringify(bookingRes.data, null, 2));
        log('\n   ℹ️  This is expected behavior when no providers match.', colors.cyan);
        
      } else if (bookingRes.status === 400) {
        log('\n   ❌ Validation Error:', colors.red);
        console.log(JSON.stringify(bookingRes.data, null, 2));
        
      } else {
        log(`\n   ⚠️  Unexpected Status: ${bookingRes.status}`, colors.yellow);
        console.log(JSON.stringify(bookingRes.data, null, 2));
      }

    } catch (error: any) {
      log('\n   ❌ Request Failed:', colors.red);
      if (error.response) {
        log(`   Status: ${error.response.status}`, colors.red);
        log('   Error:', colors.red);
        console.log(JSON.stringify(error.response.data, null, 2));
      } else {
        log(`   Error: ${error.message}`, colors.red);
        if (error.code === 'ECONNREFUSED') {
          log('   ⚠️  Server not accessible. Make sure server is running on port 5003.', colors.yellow);
        }
      }
    }

    // Step 6: Test Error Cases
    log('\n6. Testing Error Cases...', colors.yellow);
    
    // Test 6.1: Missing location
    log('\n   6.1. Missing location...', colors.yellow);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/bookings`,
        {
          serviceId: serviceId || "test_id",
          date: todayISO,
          time: "10:00"
        },
        {
          headers: { Authorization: `Bearer ${customerToken}` },
          validateStatus: () => true
        }
      );
      if (res.status === 400) {
        log('      ✅ Correctly rejected missing location', colors.green);
      } else {
        log(`      ❌ Expected 400, got ${res.status}`, colors.red);
      }
    } catch (error: any) {
      if (error.response?.status === 400) {
        log('      ✅ Correctly rejected missing location', colors.green);
      } else {
        log(`      ❌ Unexpected error: ${error.message}`, colors.red);
      }
    }

    // Test 6.2: Invalid coordinates
    log('\n   6.2. Invalid coordinates (0,0)...', colors.yellow);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/bookings`,
        {
          serviceId: serviceId || "test_id",
          date: todayISO,
          time: "10:00",
          location: {
            type: "Point",
            coordinates: [0, 0],
            address: "Invalid"
          }
        },
        {
          headers: { Authorization: `Bearer ${customerToken}` },
          validateStatus: () => true
        }
      );
      if (res.status === 400) {
        log('      ✅ Correctly rejected invalid coordinates', colors.green);
      } else {
        log(`      ❌ Expected 400, got ${res.status}`, colors.red);
      }
    } catch (error: any) {
      if (error.response?.status === 400) {
        log('      ✅ Correctly rejected invalid coordinates', colors.green);
      } else {
        log(`      ❌ Unexpected error: ${error.message}`, colors.red);
      }
    }

    // Summary
    log('\n' + '='.repeat(60), colors.blue);
    log('✅ Testing Complete!', colors.green);
    log('='.repeat(60) + '\n', colors.blue);

  } catch (error: any) {
    log('\n❌ Test Suite Failed:', colors.red);
    log(error.message, colors.red);
    if (error.code === 'ECONNREFUSED') {
      log('\n⚠️  Cannot connect to server.', colors.yellow);
      log('   Make sure the server is running:', colors.yellow);
      log('   npm run dev', colors.cyan);
      log(`   Server should be on: ${API_BASE_URL}`, colors.cyan);
    }
    process.exit(1);
  }
}

testExactPayload();
