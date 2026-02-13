/**
 * Detailed Booking Test - Check response status codes
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5003';

async function testDetailed() {
  console.log('\n🔍 Detailed Booking Tests\n');

  // Login
  const testEmail = `test_booking_${Date.now()}@test.com`;
  await axios.post(`${API_BASE_URL}/auth/register`, {
    email: testEmail,
    password: 'Test123!@#',
    firstName: 'Test',
    lastName: 'Customer',
    role: 'customer',
    phone: '+27123456789'
  }).catch(() => {});

  const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
    email: testEmail,
    password: 'Test123!@#'
  });
  const token = loginRes.data.token;

  // Get service
  const servicesRes = await axios.get(`${API_BASE_URL}/services`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const services = Array.isArray(servicesRes.data) ? servicesRes.data : servicesRes.data.services || [];
  const service = services.find((s: any) => s.adminApproved && s.status === 'active');
  
  if (!service) {
    console.log('❌ No approved service found');
    return;
  }

  console.log(`✅ Found service: ${service.title} (${service.id})\n`);

  // Test 1: Booking with serviceId
  console.log('Test 1: Booking with serviceId');
  try {
    const res = await axios.post(
      `${API_BASE_URL}/bookings`,
      {
        serviceId: service.id,
        date: new Date().toISOString(),
        time: '10:00',
        location: {
          type: 'Point',
          coordinates: [28.0473, -26.2041],
          address: '123 Test St, Johannesburg'
        },
        notes: 'Test',
        jobSize: 'medium'
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true // Don't throw on any status
      }
    );
    console.log(`   Status: ${res.status}`);
    console.log(`   Response keys: ${Object.keys(res.data).join(', ')}`);
    console.log(`   Has booking: ${!!res.data.booking}`);
    console.log(`   Has id: ${!!res.data.id}`);
    console.log(`   Message: ${res.data.message || 'N/A'}`);
  } catch (error: any) {
    console.log(`   Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data:`, JSON.stringify(error.response.data, null, 2));
    }
  }

  // Test 2: Missing location
  console.log('\nTest 2: Missing location');
  try {
    const res = await axios.post(
      `${API_BASE_URL}/bookings`,
      {
        serviceId: service.id,
        date: new Date().toISOString(),
        time: '10:00'
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true
      }
    );
    console.log(`   Status: ${res.status}`);
    console.log(`   Message: ${res.data.message || 'N/A'}`);
  } catch (error: any) {
    console.log(`   Status: ${error.response?.status || 'N/A'}`);
    console.log(`   Message: ${error.response?.data?.message || error.message}`);
  }
}

testDetailed();
