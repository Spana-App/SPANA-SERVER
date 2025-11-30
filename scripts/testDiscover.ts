/**
 * Test Discover Services Endpoint
 * Tests the new /services/discover route with customer authentication
 */

import axios from 'axios';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5003';

async function testDiscoverServices() {
  console.log('🧪 Testing Discover Services Endpoint\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  try {
    // Step 1: Register a test customer
    console.log('📝 Step 1: Registering test customer...');
    const customerEmail = `test-customer-discover-${Date.now()}@test.com`;
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
      email: customerEmail,
      password: 'Test123!',
      firstName: 'Test',
      lastName: 'Customer',
      phone: '+27123456789',
      role: 'customer'
    }, { validateStatus: () => true });

    if (registerResponse.status !== 201) {
      console.log('⚠️  Customer might already exist, trying to login...');
    } else {
      console.log('✅ Customer registered:', customerEmail);
    }

    // Step 2: Login as customer
    console.log('\n🔐 Step 2: Logging in as customer...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: customerEmail,
      password: 'Test123!'
    }, { validateStatus: () => true });

    if (loginResponse.status !== 200 || !loginResponse.data.token) {
      console.error('❌ Login failed:', loginResponse.data);
      process.exit(1);
    }

    const token = loginResponse.data.token;
    const customerId = loginResponse.data.user?._id || loginResponse.data.user?.id;
    console.log('✅ Customer logged in successfully');
    console.log('   Token:', token.substring(0, 20) + '...');
    console.log('   Customer ID:', customerId);

    // Step 3: Test discover endpoint WITHOUT token (public)
    console.log('\n🌐 Step 3: Testing /services/discover (PUBLIC - no token)...');
    const publicResponse = await axios.get(`${BASE_URL}/services/discover`, {
      validateStatus: () => true
    });

    console.log('   Status:', publicResponse.status);
    if (publicResponse.status === 200) {
      console.log('   ✅ Public endpoint works!');
      console.log('   Recently Booked Count:', publicResponse.data.recentlyBooked?.length || 0);
      console.log('   Suggested Count:', publicResponse.data.suggested?.length || 0);
      console.log('   Has User Location:', publicResponse.data.meta?.hasUserLocation || false);
    } else {
      console.log('   ❌ Public endpoint failed:', publicResponse.data);
    }

    // Step 4: Test discover endpoint WITH token (authenticated)
    console.log('\n🔒 Step 4: Testing /services/discover (AUTHENTICATED - with token)...');
    const authResponse = await axios.get(`${BASE_URL}/services/discover`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      validateStatus: () => true
    });

    console.log('   Status:', authResponse.status);
    if (authResponse.status === 200) {
      console.log('   ✅ Authenticated endpoint works!');
      console.log('   Recently Booked Count:', authResponse.data.recentlyBooked?.length || 0);
      console.log('   Suggested Count:', authResponse.data.suggested?.length || 0);
      console.log('   Has User Location:', authResponse.data.meta?.hasUserLocation || false);
      
      // Show sample data
      if (authResponse.data.recentlyBooked && authResponse.data.recentlyBooked.length > 0) {
        console.log('\n   📋 Sample Recently Booked Service:');
        const sample = authResponse.data.recentlyBooked[0];
        console.log('      Booking ID:', sample.bookingId);
        console.log('      Service:', sample.service.title);
        console.log('      Category:', sample.service.category);
        console.log('      Price: R', sample.service.price);
        console.log('      Booked At:', sample.bookedAt);
        console.log('      Status:', sample.status);
      }

      if (authResponse.data.suggested && authResponse.data.suggested.length > 0) {
        console.log('\n   🎯 Sample Suggested Service:');
        const sample = authResponse.data.suggested[0];
        console.log('      Service ID:', sample.id);
        console.log('      Title:', sample.title);
        console.log('      Category:', sample.category);
        console.log('      Price: R', sample.price);
        console.log('      Distance:', sample.distance, 'km');
        console.log('      Suggested:', sample.suggested);
      } else {
        console.log('\n   ℹ️  No suggested services (user might not have location set)');
      }
    } else {
      console.log('   ❌ Authenticated endpoint failed:', authResponse.data);
    }

    // Step 5: Show full response (formatted)
    console.log('\n📄 Full Response (Authenticated):');
    console.log('='.repeat(80));
    console.log(JSON.stringify(authResponse.data, null, 2));
    console.log('='.repeat(80));

    // Step 6: Test with query parameters
    console.log('\n🔧 Step 5: Testing with query parameters (?limit=5&suggestionsLimit=3)...');
    const paramResponse = await axios.get(`${BASE_URL}/services/discover?limit=5&suggestionsLimit=3`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      validateStatus: () => true
    });

    if (paramResponse.status === 200) {
      console.log('   ✅ Query parameters work!');
      console.log('   Recently Booked Count:', paramResponse.data.recentlyBooked?.length || 0, '(requested: 5)');
      console.log('   Suggested Count:', paramResponse.data.suggested?.length || 0, '(requested: 3)');
    }

    console.log('\n✅ All tests completed!\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests
testDiscoverServices();

