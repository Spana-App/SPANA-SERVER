/**
 * Test with Exact Payload Format from Documentation
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5003';

async function testExactPayload() {
  console.log('\n🧪 Testing Exact Payload Format\n');

  // Login
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
  } catch (e: any) {
    if (e.response?.status !== 400 || !e.response?.data?.message?.includes('already exists')) {
      console.log('Registration error:', e.response?.data?.message);
    }
  }

  const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
    email: testEmail,
    password: 'Test123!@#'
  });
  const token = loginRes.data.token;
  console.log('✅ Logged in\n');

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

  // Exact payload from documentation
  const exactPayload = {
    "serviceId": service.id,
    "date": "2025-11-15T10:00:00Z",
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

  console.log('📤 Sending exact payload:');
  console.log(JSON.stringify(exactPayload, null, 2));
  console.log('');

  try {
    const res = await axios.post(
      `${API_BASE_URL}/bookings`,
      exactPayload,
      {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true
      }
    );

    console.log(`📥 Response Status: ${res.status}`);
    console.log('📥 Response Body:');
    console.log(JSON.stringify(res.data, null, 2));

    if (res.status === 201) {
      console.log('\n✅ SUCCESS - Booking created!');
      console.log(`   Booking ID: ${res.data.booking?.id || res.data.id}`);
      console.log(`   Status: ${res.data.booking?.status || res.data.status}`);
      console.log(`   Calculated Price: R${res.data.booking?.calculatedPrice || res.data.calculatedPrice}`);
    } else if (res.status === 202) {
      console.log('\n⚠️  Booking queued (no providers available)');
      console.log(`   Message: ${res.data.message}`);
    } else {
      console.log('\n❌ Unexpected status code');
    }
  } catch (error: any) {
    console.log('\n❌ Error:');
    console.log(`   Status: ${error.response?.status || 'N/A'}`);
    console.log(`   Message: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.log('   Full Error:');
      console.log(JSON.stringify(error.response.data, null, 2));
    }
  }
}

testExactPayload();
